// Sprites for things the renderer drew in code, and the app's icons (D-158): the drone, the hub breach,
// the Mk2 and Mk3 plates, the glow in a Hardcore nest's burrows, and the app icon and favicon.
// Run `node art/extras.mjs`; it also rasterises the icons into public/ with Playwright's Chromium.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'src', 'art');
const INK = '#0f1a2e';
const f1 = (n) => n.toFixed(1);
const TAU = Math.PI * 2;
const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>\n`;
const write = (key, s) => {
  writeFileSync(join(ART, `${key}.svg`), s);
  console.log(`${key}.svg`);
};
/** Square frames side by side; each frame's ids get their own suffix. */
const strip = (size, frames) =>
  svg(
    `0 0 ${size * frames.length} ${size}`,
    frames
      .map((body, i) => {
        let s = body;
        for (const id of [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])) s = s.replaceAll(`id="${id}"`, `id="${id}-f${i}"`).replaceAll(`url(#${id})`, `url(#${id}-f${i})`);
        return `<svg x="${i * size}" y="0" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${s}</svg>`;
      })
      .join('\n'),
  );
/** A seeded random number generator, so every run draws the same. */
const rng = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

// --- The drone (D-128): a shell with a hazard stripe and a camera eye, two blades on each rotor turning
// (opposite corners the same way, as on a real quadcopter), and nav lights that blink. Faces east.
write(
  'units/drone_4f',
  strip(
    64,
    [0, 1, 2, 3].map(
      (i) =>
        `<defs><radialGradient id="dB" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#7fa8bd" /><stop offset="1" stop-color="#2b4552" /></radialGradient></defs>` +
        `<g stroke="${INK}" stroke-width="5" stroke-linecap="round"><path d="M18 18 L46 46 M46 18 L18 46" /></g><g stroke="#8d99a6" stroke-width="2.6" stroke-linecap="round"><path d="M18 18 L46 46 M46 18 L18 46" /></g>` +
        [[16, 16, 1], [48, 16, -1], [16, 48, -1], [48, 48, 1]]
          .map(([x, y, dir]) => {
            const a = dir * i * 22.5 + (x + y) * 2;
            return (
              `<circle cx="${x}" cy="${y}" r="11" fill="#dfeaf2" opacity="0.28" stroke="${INK}" stroke-opacity="0.35" stroke-width="1" />` +
              `<g transform="rotate(${a} ${x} ${y})"><path d="M${x - 10} ${y} H${x + 10}" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" /><path d="M${x - 10} ${y} H${x + 10}" stroke="#c9d2de" stroke-width="1.6" stroke-linecap="round" /></g>` +
              `<circle cx="${x}" cy="${y}" r="2.6" fill="#3a4656" stroke="${INK}" stroke-width="1.2" />`
            );
          })
          .join('') +
        `<rect x="22" y="23" width="20" height="18" rx="6" fill="url(#dB)" stroke="${INK}" stroke-width="2.4" />` +
        `<path d="M25 37 H39" stroke="#f2c14e" stroke-width="2.4" stroke-linecap="round" />` +
        `<circle cx="38" cy="32" r="2.6" fill="${INK}" /><circle cx="38.6" cy="31.4" r="0.9" fill="#9ad4ff" />` +
        `<path d="M26 26.5 Q30 24.5 35 25.5" stroke="#d6ecff" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.8" />` +
        `<circle cx="32" cy="22" r="1.6" fill="${i % 2 ? '#6ee07a' : '#2f6a3a'}" stroke="${INK}" stroke-width="0.6" /><circle cx="32" cy="42" r="1.6" fill="${i % 2 ? '#7a2a22' : '#ff6a5a'}" stroke="${INK}" stroke-width="0.6" />`,
    ),
  ),
);

// --- The hub breach: a flash, a shockwave of blue light with a soft edge, a ring of dust behind it, and
// chunks of the hub thrown out tumbling (6 frames).
{
  const r = rng(5);
  const chunks = Array.from({ length: 10 }, () => [r() * TAU, 0.7 + r() * 0.5, 2 + r() * 2.5, r() * 360]);
  write(
    'effects/hub_breach_6f',
    strip(
      128,
      [0, 1, 2, 3, 4, 5].map((i) => {
        const t = i / 5;
        const R = 10 + t * 50;
        const fade = 1 - t;
        let s = '';
        if (i < 2) s += `<circle cx="64" cy="64" r="${18 - i * 4}" fill="#e8f6ff" opacity="${f1(0.9 - i * 0.35)}" />`;
        s += `<circle cx="64" cy="64" r="${f1(R)}" fill="none" stroke="#3fa9f5" stroke-width="${f1(10 * fade + 1)}" opacity="${f1(0.35 * fade + 0.05)}" />`;
        s += `<circle cx="64" cy="64" r="${f1(R)}" fill="none" stroke="#bfe4ff" stroke-width="${f1(2.6 * fade + 0.4)}" opacity="${f1(0.9 * fade + 0.1)}" />`;
        const dr = rng(8);
        for (let k = 0; k < 20; k++) {
          const a = (k / 20) * TAU + dr() * 0.3;
          const rr = R * (0.7 + dr() * 0.2);
          s += `<circle cx="${f1(64 + rr * Math.cos(a))}" cy="${f1(64 + rr * Math.sin(a))}" r="${f1((2 + t * 5) * (0.6 + dr() * 0.8))}" fill="#a89a84" opacity="${f1(0.4 * fade * (0.5 + dr() * 0.5))}" />`;
        }
        for (const [a, sp, sz, rot] of chunks) {
          const d = 8 + sp * t * 52;
          const x = 64 + d * Math.cos(a);
          const y = 64 + d * Math.sin(a) - 10 * Math.sin(t * Math.PI) * sp;
          s += `<rect x="${f1(x - sz)}" y="${f1(y - sz)}" width="${f1(sz * 2)}" height="${f1(sz * 1.5)}" rx="0.8" transform="rotate(${f1(rot + t * 300)} ${f1(x)} ${f1(y)})" fill="#5a6478" stroke="${INK}" stroke-width="1" opacity="${f1(1 - t * 0.7)}" />`;
        }
        return s;
      }),
    ),
  );
}

// --- Mk2 and Mk3 plates (D-122, D-127): bevelled and riveted, with raised chevrons, glowing while the
// machine has electricity and dull without. Drawn in a 64 × 56 box, bottom-left of the machine.
for (const [name, light, dark, n] of [['mk2', '#ffe48a', '#c8901e', 2], ['mk3', '#c8f0ff', '#3f8fc0', 3]])
  for (const on of [true, false]) {
    const x = 8, y = 8, w = 48, h = 40, cx = 32;
    const chev = (n === 3 ? [-7.5, 0, 7.5] : [-4, 5]).map((dy) => `M${cx - 12} ${y + h / 2 + dy + 5} L${cx} ${y + h / 2 + dy - 4} L${cx + 12} ${y + h / 2 + dy + 5}`).join(' ');
    write(
      `effects/plate_${name}${on ? '' : '_off'}`,
      svg(
        '0 0 64 56',
        `<defs><linearGradient id="pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${on ? light : '#8a8a80'}" /><stop offset="1" stop-color="${on ? dark : '#4a4a44'}" /></linearGradient></defs>` +
          (on ? `<rect x="${x - 6}" y="${y - 6}" width="${w + 12}" height="${h + 12}" rx="12" fill="${light}" opacity="0.3" />` : '') +
          `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="url(#pl)" stroke="${INK}" stroke-width="4" />` +
          `<path d="M${x + 5} ${y + 4} H${x + w - 5}" stroke="#ffffff" stroke-width="2.2" opacity="${on ? 0.7 : 0.3}" />` +
          `<path d="${chev}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" /><path d="${chev}" fill="none" stroke="${on ? '#ffffff' : '#9a9a90'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" transform="translate(0 -1.5)" />` +
          [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="2" fill="${INK}" opacity="0.7" />`).join(''),
      ),
    );
  }

// --- Hardcore nests (D-133): their burrows glow red-orange from deep inside. One overlay per nest
// drawing, lighting the holes it has (found in its own markup); the game pulses it slowly.
for (const file of readdirSync(join(ART, 'nests')).filter((f) => /^(warren|runnel|hive|den|barrow)_(1|2|3|queen)\.svg$/.test(f))) {
  const nest = readFileSync(join(ART, 'nests', file), 'utf8');
  const vb = /viewBox="([^"]+)"/.exec(nest)[1];
  // Burrows: the near-black ellipses big enough to be holes rather than specks.
  const holes = [...nest.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)" fill="#0[0-4]0[0-4]0[0-4]"\s*\/>/g)].map((m) => m.slice(1).map(Number)).filter(([, , rx]) => rx >= 3);
  if (!holes.length) throw new Error(`${file}: no burrows found to light`);
  write(
    `nests/${file.replace('.svg', '')}_glow`,
    svg(
      vb,
      `<defs><radialGradient id="hg" cx="50%" cy="58%" r="55%"><stop offset="0" stop-color="#fff0a0" /><stop offset="0.3" stop-color="#ff8a2a" /><stop offset="0.7" stop-color="#c81e10" /><stop offset="1" stop-color="#2a0604" /></radialGradient><filter id="hgb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.2" /></filter></defs>` +
        holes.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#2a0604" /><ellipse cx="${cx}" cy="${f1(cy + ry * 0.12)}" rx="${f1(rx * 0.85)}" ry="${f1(ry * 0.85)}" fill="url(#hg)" filter="url(#hgb)" />`).join(''),
    ),
  );
}

// --- The app icon and favicon. The icon sets the logo's factory and shield in the clearing at dusk, with
// pines behind and the hazard stripe along the bottom; the favicon keeps only the shield and its cannon,
// so it reads at 16 pixels.
const icon = (pad) =>
  svg(
    '0 0 128 128',
    `<defs><linearGradient id="aiSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2f5a" /><stop offset="0.65" stop-color="#3a5a8a" /><stop offset="1" stop-color="#e09a5a" /></linearGradient>
<pattern id="aiHaz" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#f2c14e" /><rect width="6" height="12" fill="#1b2230" /></pattern></defs>
<rect width="128" height="128" fill="url(#aiSky)" />
<g transform="translate(64 64) scale(${1 - pad}) translate(-64 -64)">
<g fill="#ffffff" opacity="0.8"><circle cx="18" cy="16" r="1" /><circle cx="40" cy="9" r="0.8" /><circle cx="58" cy="22" r="0.9" /><circle cx="12" cy="40" r="0.7" /></g>
${[[-4, 96, 1.1], [8, 92, 1.3], [112, 92, 1.2], [124, 97, 1]].map(([x, y, s]) => `<path d="M${x} ${y - 30 * s} L${x + 10 * s} ${y} H${x - 10 * s} Z" fill="#14301f" />`).join('')}
<path d="M-40 96 Q64 84 168 96 V168 H-40 Z" fill="#2e4d33" /><path d="M0 100 Q64 89 128 100" stroke="#4f7a4a" stroke-width="2" fill="none" />
<path d="M84 26 q-2 -10 8 -12 q4 -8 14 -3 q10 0 8 10 q-4 7 -12 5 q-8 6 -18 0 Z" fill="#9ab8d8" opacity="0.9" />
<path d="M16 100 V60 L36 72 V60 L56 72 V60 L76 72 V30 H90 V100 Z" fill="#e8eef6" stroke="#16305a" stroke-width="3" stroke-linejoin="round" />
<path d="M78 34 V96" stroke="#c4d2e4" stroke-width="3" />
<g fill="#ffd36b"><rect x="23" y="80" width="9" height="9" rx="1.5" /><rect x="40" y="80" width="9" height="9" rx="1.5" /><rect x="57" y="80" width="9" height="9" rx="1.5" /></g>
<path d="M94 58 L116 66 V82 C116 95 106 103 94 108 C82 103 72 95 72 82 V66 Z" fill="#3fa9f5" stroke="#16305a" stroke-width="5" stroke-linejoin="round" />
<path d="M78 69 L94 63 V103 C85 98 78 92 78 82 Z" fill="#7cc4ff" opacity="0.5" />
<circle cx="94" cy="84" r="8" fill="#ffffff" /><rect x="94" y="81" width="15" height="6" rx="2" fill="#ffffff" />
</g>
<rect x="-10" y="${112 + pad * 16}" width="150" height="20" fill="url(#aiHaz)" opacity="0.95" />`,
  );
const favicon = svg('0 0 32 32', `<rect width="32" height="32" rx="7" fill="#1d3b6e" /><path d="M16 4 L27 8 V16 C27 22.5 22 26.5 16 29 C10 26.5 5 22.5 5 16 V8 Z" fill="#3fa9f5" stroke="${INK}" stroke-width="2" stroke-linejoin="round" /><circle cx="16" cy="17" r="4.6" fill="#ffffff" /><rect x="16" y="15" width="9" height="4" rx="1.2" fill="#ffffff" />`);
writeFileSync(join(ROOT, 'public', 'favicon.svg'), favicon);
writeFileSync(join(ROOT, 'art', 'icon.svg'), icon(0));
console.log('public/favicon.svg, art/icon.svg');

// Rasterise them. The maskable icon keeps its art inside the middle 80%, as the platforms ask.
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.log('Playwright not found: skipped the PNG icons');
}
if (chromium) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const png = async (markup, size, file) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0"><img style="display:block" width="${size}" height="${size}" src="data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}"></body></html>`);
    await page.waitForTimeout(50);
    await page.screenshot({ path: join(ROOT, file) });
    console.log(file);
  };
  await png(icon(0), 1024, 'art/icon-1024.png');
  await png(icon(0), 512, 'public/icon-512.png');
  await png(icon(0), 192, 'public/icon-192.png');
  await png(icon(0), 180, 'public/apple-touch-icon.png');
  await png(icon(0.2), 512, 'public/icon-maskable-512.png');
  await png(favicon, 32, 'public/favicon-32.png');
  await browser.close();
}
