// Ideas batch 5, part 2 (D-160): life in the clearing, people, icons and wear. Birds, a rabbit and a deer;
// a broadleaf tree in blossom, a butterfly, flowers closed for the night; the engineer getting back up; a
// badge for every research topic; cracks for walls; worn stakes for a spike pit.
// Run `node art/clearing.mjs` after redrawing a tree, a flower, the engineer, a spike pit or a building
// a research topic unlocks.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART = join(ROOT, 'src', 'art');
const INK = '#0f1a2e';
const f1 = (n) => n.toFixed(1);
const TAU = Math.PI * 2;
const read = (key) => readFileSync(join(ART, `${key}.svg`), 'utf8');
const has = (key) => existsSync(join(ART, `${key}.svg`));
const write = (key, s) => {
  writeFileSync(join(ART, `${key}.svg`), s);
  console.log(`${key}.svg`);
};
const inner = (s) => s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const box = (s) => /viewBox="([^"]+)"/.exec(s)[1];
const svg = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>\n`;
const strip = (size, frames, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * frames.length} ${size}"><defs>${defs}</defs>\n` +
  frames
    .map((body, i) => {
      let s = body;
      for (const id of [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])) s = s.replaceAll(`id="${id}"`, `id="${id}-f${i}"`).replaceAll(`url(#${id})`, `url(#${id}-f${i})`);
      return `<svg x="${i * size}" y="0" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${s}</svg>`;
    })
    .join('\n') +
  '\n</svg>\n';
const rng = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// --- A bird seen from above, its wings beating (32 × 32 frames).
write(
  'units/bird_4f',
  strip(
    32,
    [14, 6, -6, 6].map((w) => `<path d="M16 16 Q${16 - 7} ${16 - w} 4 ${16 - w * 0.6} M16 16 Q${16 + 7} ${16 - w} 28 ${16 - w * 0.6}" fill="none" stroke="#2a2a30" stroke-width="2.4" stroke-linecap="round" /><ellipse cx="16" cy="16" rx="2" ry="3.4" fill="#3a3a44" /><circle cx="16" cy="12" r="1.6" fill="#3a3a44" />`),
  ),
);

// --- A rabbit hopping (facing east, 64 × 64).
write(
  'units/rabbit_4f',
  strip(
    64,
    [0, 1, 2, 3].map((i) => {
      const hop = [0, -4, -6, -2][i];
      const stretch = [1, 1.15, 1.1, 0.95][i];
      return (
        `<ellipse cx="32" cy="36" rx="11" ry="7" fill="#000" opacity="${f1(0.25 - Math.abs(hop) * 0.02)}" /><g transform="translate(0 ${hop})">` +
        `<g transform="translate(30 32) scale(${stretch} 1) translate(-30 -32)"><ellipse cx="28" cy="32" rx="11" ry="8" fill="#9a8270" stroke="${INK}" stroke-width="1.8" /><circle cx="17" cy="32" r="3.4" fill="#f4efe6" stroke="${INK}" stroke-width="1.2" /></g>` +
        `<circle cx="40" cy="32" r="6" fill="#a88c78" stroke="${INK}" stroke-width="1.8" /><path d="M38 28 Q34 20 28 ${20 + (i % 2)} M38 36 Q34 44 28 ${44 - (i % 2)}" stroke="${INK}" stroke-width="4.6" stroke-linecap="round" fill="none" /><path d="M38 28 Q34 20 28 ${20 + (i % 2)} M38 36 Q34 44 28 ${44 - (i % 2)}" stroke="#c8a898" stroke-width="2.6" stroke-linecap="round" fill="none" /><circle cx="43" cy="30" r="1" fill="${INK}" /><circle cx="43" cy="34" r="1" fill="${INK}" /><circle cx="46" cy="32" r="1" fill="#e08a8a" /></g>`
      );
    }),
  ),
);

// --- A deer grazing: its head dips to the grass and comes up (facing east, 96 × 96).
write(
  'units/deer_4f',
  strip(
    96,
    [0, 6, 12, 4].map(
      (head) =>
        `<ellipse cx="48" cy="52" rx="24" ry="12" fill="#000" opacity="0.25" />` +
        `<ellipse cx="44" cy="48" rx="20" ry="11" fill="#9a6a3a" stroke="${INK}" stroke-width="2" /><path d="M30 44 Q44 40 58 44" stroke="#c89a6a" stroke-width="2" fill="none" /><g fill="#f4efe6"><circle cx="40" cy="44" r="1.3" /><circle cx="48" cy="45" r="1.3" /><circle cx="44" cy="51" r="1.3" /></g><circle cx="24" cy="48" r="3" fill="#f4efe6" stroke="${INK}" stroke-width="1.2" />` +
        `<g transform="translate(${f1(-head * 0.2)} 0) rotate(${head} 62 48)"><path d="M60 48 L72 48" stroke="${INK}" stroke-width="7" stroke-linecap="round" /><path d="M60 48 L72 48" stroke="#9a6a3a" stroke-width="5" stroke-linecap="round" /><ellipse cx="76" cy="48" rx="6" ry="4.4" fill="#a8784a" stroke="${INK}" stroke-width="1.8" /><path d="M72 44 L68 36 M72 52 L68 60 M70 40 l-4 -2 M70 56 l-4 2" stroke="#6a4a2a" stroke-width="2" stroke-linecap="round" /><circle cx="81" cy="48" r="1.4" fill="${INK}" /></g>`,
    ),
  ),
);

// --- A butterfly, its wings opening and closing (32 × 32).
write(
  'effects/butterfly_4f',
  strip(
    32,
    [1, 0.6, 0.15, 0.6].map((w) => {
      const wing = (sy) => `<g transform="translate(16 16) scale(1 ${f1(sy * w)})"><path d="M0 0 Q-10 -12 -2 -13 Q4 -12 1 0 Z" fill="#f2a03a" stroke="${INK}" stroke-width="0.9" /><path d="M0 0 Q8 -9 10 -4 Q8 1 1 0 Z" fill="#ffd36b" stroke="${INK}" stroke-width="0.9" /><circle cx="-3" cy="-8" r="1.4" fill="${INK}" /></g>`;
      return wing(1) + wing(-1) + `<ellipse cx="16" cy="16" rx="5" ry="1.4" fill="${INK}" /><path d="M21 15.5 l3 -2 M21 16.5 l3 2" stroke="${INK}" stroke-width="0.7" />`;
    }),
  ),
);

// --- The spring broadleaf tree in blossom: pink flowers over its crown.
{
  const t = read('terrain/tree_round_spring');
  const vb = box(t).split(' ').map(Number);
  const c = vb[2] / 2;
  const r = rng(51);
  const dots = Array.from({ length: 40 }, () => [c - 40 + r() * 80, c - 40 + r() * 80, 2 + r() * 2.2]).filter(([x, y]) => (x - c) ** 2 + (y - c) ** 2 < 40 ** 2);
  write(
    'terrain/tree_round_blossom',
    t.replace(/<\/svg>\s*$/, `<g>${dots.map(([x, y, s]) => `<g transform="translate(${f1(x)} ${f1(y)})">${[0, 72, 144, 216, 288].map((a) => `<circle cx="${f1(s * 0.7 * Math.cos((a * Math.PI) / 180))}" cy="${f1(s * 0.7 * Math.sin((a * Math.PI) / 180))}" r="${f1(s * 0.55)}" fill="#ffd6e6" />`).join('')}<circle r="${f1(s * 0.3)}" fill="#ffb347" /></g>`).join('')}</g></svg>`),
  );
}

// --- Flowers closed for the night: each flower's five petals folded in toward its middle.
for (const name of ['flowers', 'flowers_blue']) {
  const s = read(`terrain/${name}`);
  const closed = s.replace(/<g fill="(#[0-9a-f]{6})">((?:<circle [^>]*\/>){5})<\/g>/g, (m, fill, circles) => {
    const pts = [...circles.matchAll(/cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((c) => c.slice(1).map(Number));
    const cx = pts.reduce((a, p) => a + p[0], 0) / 5;
    const cy = pts.reduce((a, p) => a + p[1], 0) / 5;
    return `<g fill="${fill}">${pts.map(([x, y, rr]) => `<circle cx="${f1(cx + (x - cx) * 0.4)}" cy="${f1(cy + (y - cy) * 0.4)}" r="${f1(rr * 0.75)}" />`).join('')}</g>`;
  });
  if (closed === s) throw new Error(`${name}: no petals found to close`);
  // The flowers' middles hide inside the folded petals.
  write(`terrain/${name}_closed`, closed.replace(/<circle cx="(18|40|30)" cy="(26|36|46)" r="[\d.]+" fill="[^"]+" \/>/g, ''));
}

// --- The engineer getting back up after being knocked out: lying, pushing up, kneeling, standing, the stars clearing.
{
  const idle = read('units/engineer_idle_4f');
  const defs = /<defs>([\s\S]*?)<\/defs>/.exec(idle)[1].replace(/<g id="enI\d">[\s\S]*?<\/g>/g, '');
  write(
    'units/engineer_up_4f',
    strip(
      64,
      [90, 55, 20, 0].map((a, i) => {
        const stars = i < 2 ? `<g fill="#ffd36b">${[0, 1, 2].map((k) => { const ang = (k / 3) * TAU + i; return `<path transform="translate(${f1(32 + 10 * Math.cos(ang))} ${f1(12 + 4 * Math.sin(ang))}) scale(0.5)" d="M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z" />`; }).join('')}</g>` : '';
        const cheer = i === 3 ? '<path d="M24 8 l2 -5 M32 6 l0 -5 M40 8 l-2 -5" stroke="#6ee07a" stroke-width="1.8" stroke-linecap="round" />' : '';
        return `<g transform="rotate(${a} 32 32)"><use href="#enBootN" /><use href="#enTorso" /><use href="#enHandN" /><use href="#enHat" /></g>${stars}${cheer}`;
      }),
      defs,
    ),
  );
}

// --- A badge for every research topic: its first unlock (or what it costs) on a hexagon coloured by its
// age, wood, iron, then steel and electricity. For the research menu.
{
  const data = readFileSync(join(ROOT, 'src', 'sim', 'data.ts'), 'utf8');
  const topics = [...data.matchAll(/\{ id: '([a-z0-9_]+)', name: '([^']+)', cost: \{ ([a-z_]+)[^}]*\}[^\n]*?unlocks: \[([^\]]*)\]/g)].map((m) => ({ id: m[1], cost: m[3], unlocks: [...m[4].matchAll(/'([a-z0-9_]+)'/g)].map((u) => u[1]) }));
  if (topics.length < 10) throw new Error(`research: found only ${topics.length} topics in data.ts`);
  const WOOD = ['log', 'plank', 'stone', 'dowel', 'rope', 'truss'];
  const IRON = ['iron_ingot', 'iron_plate', 'iron_rod', 'rivet', 'brick', 'copper_ingot', 'gear', 'chitin'];
  for (const t of topics) {
    const [dark, light] = WOOD.includes(t.cost) ? ['#7a5a32', '#c8a06a'] : IRON.includes(t.cost) ? ['#4a5a6c', '#a8b8c8'] : ['#2a4a7a', '#7cc4ff'];
    const art = t.unlocks.map((u) => `buildings/${u}`).find(has) ?? t.unlocks.map((u) => `buildings/${u}_base`).find(has) ?? `items/${t.cost}`;
    const pic = has(art) ? `<svg x="15" y="15" width="34" height="34" viewBox="${box(read(art))}">${inner(read(art))}</svg>` : '';
    write(`ui/research_${t.id}`, svg('0 0 64 64', `<path d="M32 3 L57 17 V47 L32 61 L7 47 V17 Z" fill="${dark}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" /><path d="M32 7 L53 19 V45 L32 57 L11 45 V19 Z" fill="none" stroke="${light}" stroke-width="1.5" opacity="0.8" />${pic}`));
  }
}

// --- Cracks spreading across a wall as it's damaged (laid over any wall piece), and a spike pit worn down.
{
  const paths = ['M20 14 L26 22 L23 30', 'M23 30 L30 36 L28 46 M26 22 L34 20', 'M30 36 L40 40 L44 50 M34 20 L42 14 M28 46 L22 52'];
  for (const stage of [1, 2, 3]) {
    const d = paths.slice(0, stage).join(' ');
    write(
      `effects/crack_${stage}`,
      svg('0 0 64 64', `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /><path d="${d}" fill="none" stroke="#e8e0d0" stroke-width="0.8" opacity="0.5" transform="translate(0.8 0.8)" />` + (stage === 3 ? `<g fill="#9a8a78" stroke="${INK}" stroke-width="0.8"><path d="M44 52 l4 1 l-1 3 Z" /><path d="M20 54 l3 -1 l1 3 Z" /></g>` : '')),
    );
  }
  for (const stage of [1, 2, 3]) {
    const r = rng(80 + stage);
    let s = `<rect x="6" y="6" width="52" height="52" rx="10" fill="#5a4026" opacity="${f1(0.12 * stage)}" />`;
    for (let k = 0; k < stage * 4; k++) {
      const x = 12 + r() * 40, y = 12 + r() * 40, dx = 4 + r() * 3, dy = 1 + r() * 2;
      s += `<path d="M${f1(x)} ${f1(y)} l${f1(dx)} ${f1(dy)}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" /><path d="M${f1(x)} ${f1(y)} l${f1(dx)} ${f1(dy)}" stroke="#a87642" stroke-width="1.4" stroke-linecap="round" />`;
    }
    if (stage === 3) s += '<g fill="#3a3a30" opacity="0.6"><ellipse cx="22" cy="40" rx="6" ry="3" /><ellipse cx="42" cy="24" rx="5" ry="2.4" /></g>';
    write(`effects/spikes_worn_${stage}`, svg('0 0 64 64', s));
  }
}
